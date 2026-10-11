package repository

import (
	"context"
	"testing"

	dbent "github.com/bhr2625556394-alt/token/ent"
	"github.com/bhr2625556394-alt/token/internal/service"
	"github.com/stretchr/testify/require"
)

func expectedRoleTestUser(t *testing.T, repo *userRepository) *service.User {
	t.Helper()
	user := &service.User{
		Email: "expected-role@example.com", PasswordHash: "original-password-hash",
		Role: service.RoleUser, Status: service.StatusActive,
	}
	require.NoError(t, repo.Create(context.Background(), user))
	return user
}

func TestUserRepositoryUpdateExpectedRoleAllowsMatchingRole(t *testing.T) {
	repo, _ := newUserEntRepo(t)
	ctx := context.Background()
	user := expectedRoleTestUser(t, repo)
	expected := service.RoleUser
	user.PasswordHash = "new-password-hash"
	require.NoError(t, repo.Update(ctx, user, service.UserUpdateFields{PasswordHash: true, ExpectedRole: &expected}))
	got, err := repo.GetByID(ctx, user.ID)
	require.NoError(t, err)
	require.Equal(t, "new-password-hash", got.PasswordHash)
	require.Equal(t, service.RoleUser, got.Role)
}

func TestUserRepositoryUpdateExpectedRoleRejectsConcurrentPromotion(t *testing.T) {
	repo, client := newUserEntRepo(t)
	ctx := context.Background()
	user := expectedRoleTestUser(t, repo)
	stale, err := repo.GetByID(ctx, user.ID)
	require.NoError(t, err)
	expected := stale.Role
	// A super administrator promotes the target after the ordinary administrator's authorization.
	require.NoError(t, client.User.UpdateOneID(user.ID).SetRole(service.RoleAdmin).Exec(ctx))
	stale.PasswordHash = "attacker-password-hash"
	stale.Role = service.RoleUser
	err = repo.Update(ctx, stale, service.UserUpdateFields{PasswordHash: true, Role: true, ExpectedRole: &expected})
	require.ErrorIs(t, err, service.ErrUserRoleChanged)
	got, err := repo.GetByID(ctx, user.ID)
	require.NoError(t, err)
	require.Equal(t, "original-password-hash", got.PasswordHash)
	require.Equal(t, service.RoleAdmin, got.Role)
}

func TestUserRepositoryUpdateExpectedRoleIsCheckedAtWriteTime(t *testing.T) {
	repo, client := newUserEntRepo(t)
	ctx := context.Background()
	user := expectedRoleTestUser(t, repo)
	expected := user.Role
	user.PasswordHash = "attacker-password-hash"
	injected := false
	client.User.Use(func(next dbent.Mutator) dbent.Mutator {
		return dbent.MutateFunc(func(ctx context.Context, mutation dbent.Mutation) (dbent.Value, error) {
			userMutation, ok := mutation.(*dbent.UserMutation)
			if ok && mutation.Op().Is(dbent.OpUpdateOne) {
				if _, changesPassword := userMutation.PasswordHash(); changesPassword && !injected {
					injected = true
					// Inject the role change after Update has performed its final SELECT.
					// A read-and-recheck implementation would miss this mutation.
					if err := clientFromContext(ctx, client).User.UpdateOneID(user.ID).SetRole(service.RoleAdmin).Exec(ctx); err != nil {
						return nil, err
					}
				}
			}
			return next.Mutate(ctx, mutation)
		})
	})
	err := repo.Update(ctx, user, service.UserUpdateFields{PasswordHash: true, ExpectedRole: &expected})
	require.True(t, injected)
	require.ErrorIs(t, err, service.ErrUserRoleChanged)
	got, err := repo.GetByID(ctx, user.ID)
	require.NoError(t, err)
	require.Equal(t, "original-password-hash", got.PasswordHash)
	// The injected role mutation shares this test's transaction and rolls back with the rejected write.
	require.Equal(t, service.RoleUser, got.Role)
}

func TestUserUpdateFieldsExpectedRoleDoesNotMakeEmptyUpdate(t *testing.T) {
	expected := service.RoleUser
	require.True(t, (service.UserUpdateFields{ExpectedRole: &expected}).IsEmpty())
	require.False(t, (service.UserUpdateFields{PasswordHash: true, ExpectedRole: &expected}).IsEmpty())
}
