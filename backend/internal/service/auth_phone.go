package service

import (
	"context"
	"net/mail"
	"strings"

	infraerrors "github.com/bhr2625556394-alt/token/internal/pkg/errors"
)

// PhonePlaceholderEmailDomain is reserved for the existing non-null users.email column.
// It is never an email contact or verified identity.
const PhonePlaceholderEmailDomain = "@phone-connect.invalid"

var (
	ErrInvalidPhone          = infraerrors.BadRequest("INVALID_PHONE", "enter a valid mainland China mobile number")
	ErrPhoneExists           = infraerrors.Conflict("PHONE_EXISTS", "phone number already exists")
	ErrInvalidAuthIdentifier = infraerrors.BadRequest("INVALID_AUTH_IDENTIFIER", "provide either an email or a phone number")
)

// PhoneUserRepository is optional so repositories without phone support fail closed.
type PhoneUserRepository interface {
	GetByPhone(ctx context.Context, phone string) (*User, error)
}

// NormalizePhone supports mainland China mobile numbers, optionally prefixed with +86 or 0086.
func NormalizePhone(input string) (string, error) {
	phone := strings.TrimSpace(input)
	if strings.HasPrefix(phone, "+86") {
		phone = strings.TrimSpace(strings.TrimPrefix(phone, "+86"))
	} else if strings.HasPrefix(phone, "0086") {
		phone = strings.TrimSpace(strings.TrimPrefix(phone, "0086"))
	}
	if len(phone) != 11 || phone[0] != '1' || phone[1] < '3' || phone[1] > '9' {
		return "", ErrInvalidPhone
	}
	for _, digit := range phone {
		if digit < '0' || digit > '9' {
			return "", ErrInvalidPhone
		}
	}
	return phone, nil
}

// ValidateAuthIdentifier forbids ambiguous or missing registration/login identities.
func ValidateAuthIdentifier(email, phone string) error {
	if (strings.TrimSpace(email) == "") == (strings.TrimSpace(phone) == "") {
		return ErrInvalidAuthIdentifier
	}
	if strings.TrimSpace(phone) != "" {
		_, err := NormalizePhone(phone)
		return err
	}
	return nil
}

func phonePlaceholderEmail(phone string) string {
	return "phone-" + phone + PhonePlaceholderEmailDomain
}

func IsPhonePlaceholderEmail(email string) bool {
	normalized := strings.ToLower(strings.TrimSpace(email))
	if address, err := mail.ParseAddress(normalized); err == nil {
		normalized = address.Address
	}
	// Root-dot variants must not bypass the reserved-domain check.
	normalized = strings.TrimSuffix(normalized, ".")
	return strings.HasSuffix(normalized, PhonePlaceholderEmailDomain)
}

// PublicUserEmail hides the storage-only placeholder while preserving later real-email bindings.
func PublicUserEmail(email string) string {
	if IsPhonePlaceholderEmail(email) {
		return ""
	}
	return email
}

func (s *AuthService) getUserByPhone(ctx context.Context, phone string) (*User, error) {
	repo, ok := s.userRepo.(PhoneUserRepository)
	if !ok {
		return nil, ErrServiceUnavailable
	}
	return repo.GetByPhone(ctx, phone)
}
