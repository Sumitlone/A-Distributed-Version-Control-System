# VCS Production Test Checklist

## Authentication

- [ ] Signup with valid data.
- [ ] Login with valid credentials.
- [ ] Login fails with invalid credentials.
- [ ] Expired/invalid JWT returns 401 and redirects to `/auth`.
- [ ] Another user's repository cannot be modified.

## Repository

- [ ] Create public repository.
- [ ] Create private repository.
- [ ] Private repository is not visible to another user.
- [ ] Edit repository description.
- [ ] Toggle visibility.
- [ ] Delete repository removes MongoDB data, issues, S3 data, and local VCS cache.
- [ ] Repository settings page works.

## Search and dashboard

- [ ] Repository search returns matching public/owned repositories only.
- [ ] User search returns matching usernames.
- [ ] Dashboard statistics match the current account.
- [ ] Star/unstar updates the dashboard state.

## Issues

- [ ] Create issue.
- [ ] Edit issue.
- [ ] Open/close issue.
- [ ] Delete issue.
- [ ] Private repository issues are not accessible to unauthorized users.

## VCS / S3

- [ ] Create first commit.
- [ ] Push first commit.
- [ ] Verify S3 `repositories/<repoId>/HEAD` exists.
- [ ] Verify S3 `repositories/<repoId>/metadata.json` exists.
- [ ] Verify S3 commit snapshot exists.
- [ ] Create second commit and verify Push uploads only the new commit.
- [ ] Pull on a clean local workspace.
- [ ] Delete `.vcsRepos/<repoId>` and request VCS workspace again; verify it rebuilds from S3.
- [ ] Revert a commit; verify the revert creates a new child commit.
- [ ] Push the revert commit and verify S3 HEAD moves to the revert commit.

## Frontend UX

- [ ] Loading states render without layout jumps.
- [ ] API errors use themed alerts.
- [ ] Destructive actions use themed confirmation dialogs.
- [ ] Repository tabs work at mobile width.
- [ ] File tree opens/closes folders.
- [ ] Code editor line numbers stay aligned while scrolling.
- [ ] README.md renders from the latest remote HEAD.

## Deployment

- [ ] Backend uses a deployed `CLIENT_URL`.
- [ ] Frontend uses `VITE_API_URL`.
- [ ] No real secrets are committed.
- [ ] MongoDB, JWT, and AWS credentials exist only in deployment environment variables.
- [ ] S3 bucket policy/credentials allow only required application operations.
- [ ] CORS rejects unknown origins.
- [ ] `npm run build` completes in a clean frontend install.
- [ ] Backend starts using `npm start`.
