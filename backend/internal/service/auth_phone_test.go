//go:build unit

package service

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func (s *userRepoStub) GetByPhone(_ context.Context, phone string) (*User, error) {
	if s.getByEmailErr != nil {
		return nil, s.getByEmailErr
	}
	for _, user := range s.created {
		if user.Phone == phone {
			return user, nil
		}
	}
	if s.user != nil && s.user.Phone == phone {
		return s.user, nil
	}
	return nil, ErrUserNotFound
}

func TestNormalizePhone(t *testing.T) {
	for _, phone := range []string{"13800138000", "+8613800138000", "008613800138000", " +86 13800138000 "} {
		normalized, err := NormalizePhone(phone)
		require.NoError(t, err)
		require.Equal(t, "13800138000", normalized)
	}
	for _, phone := range []string{"", "12345678901", "1380013800", "+113800138000", "1380013800x", "１３８００１３８０００", "138001380000"} {
		_, err := NormalizePhone(phone)
		require.ErrorIs(t, err, ErrInvalidPhone, phone)
	}
}

func TestValidateAuthIdentifier(t *testing.T) {
	require.NoError(t, ValidateAuthIdentifier("user@example.com", ""))
	require.NoError(t, ValidateAuthIdentifier("", "+8613800138000"))
	require.ErrorIs(t, ValidateAuthIdentifier("", ""), ErrInvalidAuthIdentifier)
	require.ErrorIs(t, ValidateAuthIdentifier("user@example.com", "13800138000"), ErrInvalidAuthIdentifier)
	require.ErrorIs(t, ValidateAuthIdentifier("", "123"), ErrInvalidPhone)
}

func TestAuthService_RegisterPhone_PreservesRegistrationPolicyAndGrants(t *testing.T) {
	repo := &userRepoStub{nextID: 72}
	svc := newAuthService(repo, map[string]string{
		SettingKeyRegistrationEnabled:              "true",
		SettingKeyEmailVerifyEnabled:               "true",
		SettingKeyRegistrationEmailSuffixWhitelist: `["example.com"]`,
	}, nil, nil)
	token, user, err := svc.RegisterPhone(context.Background(), "+8613800138000", "password", "", "", "")
	require.NoError(t, err)
	require.NotEmpty(t, token)
	require.Equal(t, "13800138000", user.Phone)
	require.Equal(t, "phone", user.SignupSource)
	require.Equal(t, RoleUser, user.Role)
	require.Equal(t, 3.5, user.Balance)
	require.Equal(t, 2, user.Concurrency)
	require.True(t, svc.CheckPassword("password", user.PasswordHash))
	require.True(t, isReservedEmail(user.Email))
	require.Empty(t, PublicUserEmail(user.Email))
	require.Zero(t, repo.guardedCreates)
	require.Zero(t, repo.domainLimitedCreates)
	claims, err := svc.ValidateToken(token)
	require.NoError(t, err)
	require.Empty(t, claims.Email)
	require.Equal(t, RoleUser, claims.Role)

	// Unverified phone storage must never create a verified email identity.
	identity, created := svc.ensureEmailAuthIdentity(context.Background(), user, "test")
	require.Nil(t, identity)
	require.False(t, created)
}

func TestAuthService_RegisterPhone_DisabledAndInvitationRequired(t *testing.T) {
	for _, settings := range []map[string]string{nil, {SettingKeyRegistrationEnabled: "false"}} {
		repo := &userRepoStub{}
		svc := newAuthService(repo, settings, nil, nil)
		_, _, err := svc.RegisterPhone(context.Background(), "13800138000", "password", "", "", "")
		require.ErrorIs(t, err, ErrRegDisabled)
		require.Empty(t, repo.created)
	}
	repo := &userRepoStub{}
	svc := newAuthService(repo, map[string]string{
		SettingKeyRegistrationEnabled:   "true",
		SettingKeyInvitationCodeEnabled: "true",
	}, nil, nil)
	_, _, err := svc.RegisterPhone(context.Background(), "13800138000", "password", "", "", "")
	require.ErrorIs(t, err, ErrInvitationCodeRequired)
	require.Empty(t, repo.created)
}

func TestAuthService_RegisterPhone_DuplicateIndependentOfEmailBinding(t *testing.T) {
	repo := &userRepoStub{nextID: 72}
	svc := newAuthService(repo, map[string]string{SettingKeyRegistrationEnabled: "true"}, nil, nil)
	_, user, err := svc.RegisterPhone(context.Background(), "13800138000", "password", "", "", "")
	require.NoError(t, err)
	user.Email = "bound@example.com"
	_, _, err = svc.RegisterPhone(context.Background(), "008613800138000", "password", "", "", "")
	require.ErrorIs(t, err, ErrPhoneExists)
	require.Len(t, repo.created, 1)
	_, loggedIn, err := svc.LoginPhone(context.Background(), "+8613800138000", "password")
	require.NoError(t, err)
	require.Equal(t, user.ID, loggedIn.ID)
	require.Equal(t, "bound@example.com", PublicUserEmail(loggedIn.Email))
}

func TestAuthService_RegisterPhone_RaceAndDatabaseError(t *testing.T) {
	for _, tc := range []struct{ repoErr, want error }{
		{ErrPhoneExists, ErrPhoneExists},
		{ErrEmailExists, ErrPhoneExists},
		{errors.New("db unavailable"), ErrServiceUnavailable},
	} {
		repo := &userRepoStub{createErr: tc.repoErr}
		svc := newAuthService(repo, map[string]string{SettingKeyRegistrationEnabled: "true"}, nil, nil)
		_, _, err := svc.RegisterPhone(context.Background(), "13800138000", "password", "", "", "")
		require.ErrorIs(t, err, tc.want)
	}
}

func TestAuthService_LoginPhone_CredentialsAndStatus(t *testing.T) {
	repo := &userRepoStub{nextID: 72}
	svc := newAuthService(repo, map[string]string{SettingKeyRegistrationEnabled: "true"}, nil, nil)
	_, user, err := svc.RegisterPhone(context.Background(), "13800138000", "password", "", "", "")
	require.NoError(t, err)
	_, _, err = svc.LoginPhone(context.Background(), "13800138000", "wrong-password")
	require.ErrorIs(t, err, ErrInvalidCredentials)
	_, _, err = svc.LoginPhone(context.Background(), "13900139000", "password")
	require.ErrorIs(t, err, ErrInvalidCredentials)
	_, _, err = svc.Login(context.Background(), user.Email, "password")
	require.ErrorIs(t, err, ErrInvalidCredentials)
	user.Status = StatusDisabled
	_, _, err = svc.LoginPhone(context.Background(), "13800138000", "password")
	require.ErrorIs(t, err, ErrUserNotActive)
}

func TestAuthService_PhonePlaceholderCannotBeUsedByEmailOrOAuth(t *testing.T) {
	repo := &userRepoStub{}
	svc := newAuthService(repo, map[string]string{SettingKeyRegistrationEnabled: "true"}, nil, nil)
	email := phonePlaceholderEmail("13800138000")
	for _, variant := range []string{email, strings.ToUpper(email), email + ".", "Phone User <" + email + ">"} {
		require.True(t, IsPhonePlaceholderEmail(variant))
	}
	_, _, err := svc.Register(context.Background(), email, "password")
	require.ErrorIs(t, err, ErrEmailReserved)
	require.ErrorIs(t, svc.SendVerifyCode(context.Background(), email), ErrEmailReserved)
	_, _, err = svc.LoginOrRegisterOAuth(context.Background(), email, "phone-claim")
	require.ErrorIs(t, err, ErrEmailReserved)
	_, _, err = svc.LoginOrRegisterOAuthWithTokenPair(context.Background(), email, "phone-claim", "", "", "oidc")
	require.ErrorIs(t, err, ErrEmailReserved)
	_, _, proceed := svc.preparePasswordReset(context.Background(), email, "https://example.com")
	require.False(t, proceed)
	require.ErrorIs(t, svc.ResetPassword(context.Background(), email, "token", "password"), ErrInvalidResetToken)
	emailSvc := &EmailService{}
	require.ErrorIs(t, emailSvc.SendEmailWithConfig(nil, email, "subject", "body"), ErrEmailReserved)
	require.Empty(t, repo.created)
}
