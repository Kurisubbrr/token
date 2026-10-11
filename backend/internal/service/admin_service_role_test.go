//go:build unit

package service

import (
	"context"
	"net/http"
	"strconv"
	"testing"

	infraerrors "github.com/bhr2625556394-alt/token/internal/pkg/errors"
	"github.com/stretchr/testify/require"
)

func roleTestService(targetRole string) (*adminServiceImpl, *rpmUserRepoStub, *authCacheInvalidatorStub) {
	target := &User{ID: 42, Email: "target@example.com", Role: targetRole, Status: StatusActive}
	base := &userRepoStub{
		user: target,
		usersByID: map[int64]*User{
			1:  {ID: 1, Role: RoleSuperAdmin, Status: StatusActive},
			2:  {ID: 2, Role: RoleAdmin, Status: StatusActive},
			3:  {ID: 3, Role: RoleUser, Status: StatusActive},
			4:  {ID: 4, Role: RoleSuperAdmin, Status: StatusDisabled},
			42: target,
		},
		nextID: 100,
	}
	repo := &rpmUserRepoStub{userRepoStub: base}
	invalidator := &authCacheInvalidatorStub{}
	return &adminServiceImpl{userRepo: repo, redeemCodeRepo: &redeemRepoStub{}, authCacheInvalidator: invalidator}, repo, invalidator
}

func TestAdminService_CreateUser_WithAdminRole(t *testing.T) {
	svc, repo, _ := roleTestService(RoleUser)
	user, err := svc.CreateUser(context.Background(), &CreateUserInput{
		Email: "admin@test.com", Password: "strong-pass", Role: RoleAdmin, ActorAdminID: 1,
	})
	require.NoError(t, err)
	require.Equal(t, RoleAdmin, user.Role)
	require.Len(t, repo.created, 1)
}

func TestAdminService_CreateUser_RejectsPrivilegeEscalation(t *testing.T) {
	for _, actorID := range []int64{0, 2, 3, 4, 999} {
		t.Run(strconv.FormatInt(actorID, 10), func(t *testing.T) {
			svc, repo, _ := roleTestService(RoleUser)
			_, err := svc.CreateUser(context.Background(), &CreateUserInput{
				Email: "admin@test.com", Password: "strong-pass", Role: RoleAdmin, ActorAdminID: actorID,
			})
			require.Equal(t, http.StatusForbidden, infraerrors.Code(err))
			require.Empty(t, repo.created)
		})
	}
}

func TestAdminService_CreateUser_DefaultsToUserRole(t *testing.T) {
	svc, _, _ := roleTestService(RoleUser)
	user, err := svc.CreateUser(context.Background(), &CreateUserInput{Email: "plain@test.com", Password: "strong-pass"})
	require.NoError(t, err)
	require.Equal(t, RoleUser, user.Role)
}

func TestAdminService_CreateUser_RejectsAdditionalSuperAdmin(t *testing.T) {
	svc, repo, _ := roleTestService(RoleUser)
	_, err := svc.CreateUser(context.Background(), &CreateUserInput{
		Email: "owner@test.com", Password: "strong-pass", Role: RoleSuperAdmin, ActorAdminID: 1,
	})
	require.Equal(t, http.StatusForbidden, infraerrors.Code(err))
	require.Empty(t, repo.created)
}

func TestAdminService_CreateUser_InvalidRoleRejected(t *testing.T) {
	svc, repo, _ := roleTestService(RoleUser)
	_, err := svc.CreateUser(context.Background(), &CreateUserInput{Email: "bad@test.com", Password: "strong-pass", Role: "root"})
	require.Equal(t, http.StatusBadRequest, infraerrors.Code(err))
	require.Empty(t, repo.created)
}

func TestAdminService_UpdateUser_SuperAdminCanPromoteAndDemote(t *testing.T) {
	for _, roles := range [][2]string{{RoleUser, RoleAdmin}, {RoleAdmin, RoleUser}} {
		t.Run(roles[0]+"_to_"+roles[1], func(t *testing.T) {
			svc, repo, invalidator := roleTestService(roles[0])
			updated, err := svc.UpdateUser(context.Background(), 42, &UpdateUserInput{Role: roles[1], ActorAdminID: 1})
			require.NoError(t, err)
			require.Equal(t, roles[1], updated.Role)
			require.Equal(t, roles[1], repo.lastUpdated.Role)
			require.Equal(t, []int64{42}, invalidator.userIDs)
		})
	}
}

func TestAdminService_UpdateUser_OnlySuperAdminCanChangeRole(t *testing.T) {
	for _, roles := range [][2]string{{RoleUser, RoleAdmin}, {RoleAdmin, RoleUser}} {
		for _, actorID := range []int64{0, 2, 3, 4, 999} {
			svc, repo, invalidator := roleTestService(roles[0])
			_, err := svc.UpdateUser(context.Background(), 42, &UpdateUserInput{Role: roles[1], ActorAdminID: actorID})
			require.Equal(t, http.StatusForbidden, infraerrors.Code(err))
			require.Nil(t, repo.lastUpdated)
			require.Empty(t, invalidator.userIDs)
		}
	}
}

func TestAdminService_UpdateUser_TrustedContextOverridesInputActor(t *testing.T) {
	svc, repo, _ := roleTestService(RoleUser)
	_, err := svc.UpdateUser(WithAdminActorID(context.Background(), 2), 42, &UpdateUserInput{Role: RoleAdmin, ActorAdminID: 1})
	require.Equal(t, http.StatusForbidden, infraerrors.Code(err))
	require.Nil(t, repo.lastUpdated)
}

func TestAdminService_UpdateUser_AdminCannotTakeOverAnotherAdmin(t *testing.T) {
	for _, role := range []string{RoleAdmin, RoleSuperAdmin} {
		svc, repo, _ := roleTestService(role)
		_, err := svc.UpdateUser(context.Background(), 42, &UpdateUserInput{
			Email: "attacker@example.com", Password: "takeover123", ActorAdminID: 2,
		})
		require.Equal(t, http.StatusForbidden, infraerrors.Code(err))
		require.Nil(t, repo.lastUpdated)
	}
}

func TestAdminService_UpdateUser_AdminCanEditOwnProfile(t *testing.T) {
	svc, _, _ := roleTestService(RoleAdmin)
	updated, err := svc.UpdateUser(context.Background(), 42, &UpdateUserInput{Email: "own@example.com", ActorAdminID: 42})
	require.NoError(t, err)
	require.Equal(t, "own@example.com", updated.Email)
	require.Equal(t, RoleAdmin, updated.Role)
}

func TestAdminService_UpdateUser_SuperAdminProtected(t *testing.T) {
	inputs := []*UpdateUserInput{
		{Role: RoleUser, ActorAdminID: 1},
		{Role: RoleAdmin, ActorAdminID: 1},
		{Status: StatusDisabled, ActorAdminID: 1},
	}
	for _, input := range inputs {
		svc, repo, _ := roleTestService(RoleSuperAdmin)
		_, err := svc.UpdateUser(context.Background(), 42, input)
		require.Equal(t, http.StatusForbidden, infraerrors.Code(err))
		require.Nil(t, repo.lastUpdated)
	}
}

func TestAdminService_UpdateUser_SuperAdminCanEditOwnProfile(t *testing.T) {
	svc, _, _ := roleTestService(RoleSuperAdmin)
	updated, err := svc.UpdateUser(context.Background(), 42, &UpdateUserInput{Email: "own@example.com", Role: RoleSuperAdmin, ActorAdminID: 42})
	require.NoError(t, err)
	require.Equal(t, RoleSuperAdmin, updated.Role)
}

func TestAdminService_UpdateUser_CannotGrantSuperAdminRole(t *testing.T) {
	svc, repo, _ := roleTestService(RoleUser)
	_, err := svc.UpdateUser(context.Background(), 42, &UpdateUserInput{Role: RoleSuperAdmin, ActorAdminID: 1})
	require.Equal(t, http.StatusForbidden, infraerrors.Code(err))
	require.Nil(t, repo.lastUpdated)
}

func TestAdminService_UpdateUser_InvalidRoleRejected(t *testing.T) {
	svc, repo, _ := roleTestService(RoleUser)
	_, err := svc.UpdateUser(context.Background(), 42, &UpdateUserInput{Role: "root", ActorAdminID: 1})
	require.Equal(t, http.StatusBadRequest, infraerrors.Code(err))
	require.Nil(t, repo.lastUpdated)
}

func TestAdminService_DeleteUser_SuperAdminProtected(t *testing.T) {
	svc, repo, _ := roleTestService(RoleSuperAdmin)
	err := svc.DeleteUser(WithAdminActorID(context.Background(), 1), 42)
	require.Equal(t, http.StatusForbidden, infraerrors.Code(err))
	require.Empty(t, repo.deletedIDs)
}

func TestAdminService_UpdateUserBalance_AdminCannotModifySuperAdmin(t *testing.T) {
	svc, _, _ := roleTestService(RoleSuperAdmin)
	repo := &balanceUserRepoStub{userRepoStub: svc.userRepo.(*rpmUserRepoStub).userRepoStub}
	svc.userRepo = repo
	_, err := svc.UpdateUserBalance(WithAdminActorID(context.Background(), 2), 42, 100, "add", "")
	require.Equal(t, http.StatusForbidden, infraerrors.Code(err))
	require.Empty(t, repo.changes)
}

func TestAdminServiceBatchUpdateLimits_AdminCannotModifySuperAdmin(t *testing.T) {
	svc, _, _ := roleTestService(RoleSuperAdmin)
	repo := &batchLimitsUserRepoStub{userRepoStub: svc.userRepo.(*rpmUserRepoStub).userRepoStub}
	svc.userRepo = repo
	value := 10
	_, err := svc.BatchUpdateLimits(WithAdminActorID(context.Background(), 2), []int64{3, 42}, &value, nil)
	require.Equal(t, http.StatusForbidden, infraerrors.Code(err))
	require.Zero(t, repo.calls, "no partial batch update may happen before authorization completes")
}

func TestUser_IsAdminIncludesSuperAdministrator(t *testing.T) {
	require.True(t, (&User{Role: RoleSuperAdmin}).IsAdmin())
	require.True(t, (&User{Role: RoleAdmin}).IsAdmin())
	require.False(t, (&User{Role: RoleUser}).IsAdmin())
	require.True(t, (&User{Role: RoleSuperAdmin}).IsSuperAdmin())
	require.False(t, (&User{Role: RoleAdmin}).IsSuperAdmin())
}

// roleRaceUserRepo returns independent read snapshots, then simulates a
// super-administrator promotion between authorization and the atomic write.
type roleRaceUserRepo struct {
	*rpmUserRepoStub
	concurrentRole string
	lastFields     UserUpdateFields
	writes         int
}

func (s *roleRaceUserRepo) GetByID(ctx context.Context, id int64) (*User, error) {
	user, err := s.userRepoStub.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	copy := *user
	return &copy, nil
}

func (s *roleRaceUserRepo) Update(ctx context.Context, user *User, fields UserUpdateFields) error {
	s.lastFields = fields
	persisted := s.usersByID[user.ID]
	if s.concurrentRole != "" {
		persisted.Role = s.concurrentRole
	}
	if fields.ExpectedRole != nil && persisted.Role != *fields.ExpectedRole {
		return infraerrors.Conflict("USER_ROLE_CHANGED", "User role changed; reload the user before retrying")
	}
	s.writes++
	return s.rpmUserRepoStub.Update(ctx, user, fields)
}

func TestAdminService_UpdateUser_ConcurrentPromotionBlocksOldAdminPasswordReset(t *testing.T) {
	for _, suppliedRole := range []string{"", RoleUser} {
		t.Run("submitted_role_"+suppliedRole, func(t *testing.T) {
			svc, base, invalidator := roleTestService(RoleUser)
			base.usersByID[42].PasswordHash = "original-password-hash"
			repo := &roleRaceUserRepo{rpmUserRepoStub: base, concurrentRole: RoleAdmin}
			svc.userRepo = repo
			_, err := svc.UpdateUser(WithAdminActorID(context.Background(), 2), 42, &UpdateUserInput{
				Password: "old-admin-password-reset", Role: suppliedRole, ActorAdminID: 2,
			})
			require.Equal(t, http.StatusConflict, infraerrors.Code(err))
			require.NotNil(t, repo.lastFields.ExpectedRole)
			require.Equal(t, RoleUser, *repo.lastFields.ExpectedRole)
			require.False(t, repo.lastFields.Role, "an unchanged role in a stale form must not write the role column")
			require.True(t, repo.lastFields.PasswordHash)
			require.Zero(t, repo.writes)
			require.Equal(t, RoleAdmin, base.usersByID[42].Role)
			require.Equal(t, "original-password-hash", base.usersByID[42].PasswordHash)
			require.Empty(t, invalidator.userIDs)
		})
	}
}

func TestAdminService_UpdateUser_ChangedRoleWritesMaskAndRetainsAuthorizationSnapshot(t *testing.T) {
	svc, base, _ := roleTestService(RoleUser)
	repo := &roleRaceUserRepo{rpmUserRepoStub: base}
	svc.userRepo = repo
	user, err := svc.UpdateUser(WithAdminActorID(context.Background(), 1), 42, &UpdateUserInput{Role: RoleAdmin, ActorAdminID: 1})
	require.NoError(t, err)
	require.Equal(t, RoleAdmin, user.Role)
	require.True(t, repo.lastFields.Role)
	require.Equal(t, RoleUser, *repo.lastFields.ExpectedRole, "expected role must stay independent of the updated user.Role")
	require.Equal(t, 1, repo.writes)
}
