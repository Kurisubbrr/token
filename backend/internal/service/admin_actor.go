package service

import (
	"context"

	infraerrors "github.com/bhr2625556394-alt/token/internal/pkg/errors"
)

type adminActorContextKey struct{}

// WithAdminActorID records the administrator validated by the HTTP middleware.
// Authorization always reloads the user's current role from the repository.
func WithAdminActorID(ctx context.Context, userID int64) context.Context {
	return context.WithValue(ctx, adminActorContextKey{}, userID)
}

func adminActorID(ctx context.Context, explicitID int64) int64 {
	if userID, ok := ctx.Value(adminActorContextKey{}).(int64); ok && userID > 0 {
		return userID
	}
	return explicitID
}

func (s *adminServiceImpl) loadAdminActor(ctx context.Context, explicitID int64) (*User, error) {
	actorID := adminActorID(ctx, explicitID)
	if actorID <= 0 {
		return nil, infraerrors.Forbidden("SUPER_ADMIN_REQUIRED", "A super administrator is required for this operation")
	}
	actor, err := s.userRepo.GetByID(ctx, actorID)
	if err != nil || actor == nil || !actor.IsActive() || !actor.IsAdmin() {
		return nil, infraerrors.Forbidden("FORBIDDEN", "An active administrator is required for this operation")
	}
	return actor, nil
}

func (s *adminServiceImpl) requireSuperAdmin(ctx context.Context, explicitID int64) error {
	actor, err := s.loadAdminActor(ctx, explicitID)
	if err != nil {
		return err
	}
	if !actor.IsSuperAdmin() {
		return infraerrors.Forbidden("SUPER_ADMIN_REQUIRED", "Only a super administrator can manage administrator roles")
	}
	return nil
}

// authorizeAdminUserMutation prevents administrators from taking over higher
// privilege accounts through password resets, identity binding or user edits.
func (s *adminServiceImpl) authorizeAdminUserMutation(ctx context.Context, target *User, explicitID int64) error {
	if target == nil || !target.IsAdmin() {
		return nil
	}
	actor, err := s.loadAdminActor(ctx, explicitID)
	if err != nil {
		return err
	}
	if actor.IsSuperAdmin() || (actor.ID == target.ID && !target.IsSuperAdmin()) {
		return nil
	}
	return infraerrors.Forbidden("SUPER_ADMIN_REQUIRED", "Only a super administrator can modify another administrator")
}

func (s *adminServiceImpl) authorizeAdminUserIDMutation(ctx context.Context, userID int64) error {
	target, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return err
	}
	return s.authorizeAdminUserMutation(ctx, target, 0)
}

func (s *adminServiceImpl) authorizeAdminBatchMutation(ctx context.Context, userIDs []int64) error {
	// Background maintenance has no HTTP administrator; HTTP batch writes always
	// carry this context and must validate every target before the first write.
	if adminActorID(ctx, 0) <= 0 {
		return nil
	}
	for _, userID := range userIDs {
		if err := s.authorizeAdminUserIDMutation(ctx, userID); err != nil {
			return err
		}
	}
	return nil
}
