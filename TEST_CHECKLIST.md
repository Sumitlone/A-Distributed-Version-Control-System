# VCS Production Test Checklist

## 1. Web Authentication

- [ ] Signup with valid data.
- [ ] Login with valid credentials.
- [ ] Login fails with invalid credentials.
- [ ] Expired/invalid JWT returns 401 and redirects to `/auth`.
- [ ] Logout removes the frontend session.
- [ ] User A cannot modify User B's repository.

## 2. CLI Authentication

- [ ] `node index.js login` succeeds with valid credentials.
- [ ] CLI login fails with invalid credentials.
- [ ] `node index.js whoami` shows the logged-in user.
- [ ] `node index.js logout` clears CLI authentication.
- [ ] CLI commands fail when not logged in.
- [ ] User A cannot select User B's repository.
- [ ] Logging in as User B switches the active CLI identity.
- [ ] Expired CLI JWT requires login again.

## 3. Repository

- [ ] Create public repository.
- [ ] Create private repository.
- [ ] MongoDB `Repository.owner` equals the logged-in user's `_id`.
- [ ] MongoDB repository `_id` is the same ID used by the frontend VCS.
- [ ] MongoDB repository `_id` is the same ID used in S3.
- [ ] User `repositories` contains the created repository ID.
- [ ] Private repository is not visible to another user.
- [ ] Edit repository description.
- [ ] Toggle visibility.
- [ ] Repository settings page works.
- [ ] Another user cannot edit the repository.
- [ ] Another user cannot toggle repository visibility.
- [ ] Another user cannot delete the repository.
- [ ] Delete repository removes MongoDB repository data.
- [ ] Delete repository removes repository issues.
- [ ] Delete repository removes repository stars from users.
- [ ] Delete repository removes `repositories/<repoId>/` from S3.
- [ ] Delete repository removes `.vcsRepos/<repoId>/`.

## 4. Search and Dashboard

- [ ] Repository search returns matching public repositories.
- [ ] Repository search returns the current user's private/owned repositories.
- [ ] Private repositories of other users are not returned.
- [ ] User search returns matching usernames.
- [ ] Dashboard statistics match the current account.
- [ ] Star repository.
- [ ] Unstar repository.
- [ ] Deleted repository disappears from starred repositories.

## 5. Issues

- [ ] Create issue.
- [ ] Edit issue.
- [ ] Open issue.
- [ ] Close issue.
- [ ] Delete issue.
- [ ] Unauthorized user cannot modify another user's issue.
- [ ] Private repository issues are not accessible to unauthorized users.
- [ ] Deleting a repository deletes its issues.

## 6. Web VCS — Staging

- [ ] Open Version Control for repository owner.
- [ ] Non-owner can view public repository history.
- [ ] Non-owner cannot modify repository.
- [ ] Create a new file.
- [ ] Edit an existing file.
- [ ] Stage files.
- [ ] Staged file count is displayed correctly.
- [ ] Commit without staging fails.
- [ ] Commit after staging succeeds.
- [ ] Editing a staged file resets the staging requirement.
- [ ] Removing a file and staging again removes it from the next snapshot.

## 7. Web VCS — Commit

- [ ] Create first commit.
- [ ] Verify commit receives a UUID.
- [ ] Verify first commit has no parent.
- [ ] Create second commit.
- [ ] Verify second commit parent equals first commit.
- [ ] Verify committed files match the staged snapshot.
- [ ] Verify staging clears after commit.
- [ ] Verify local HEAD moves to the new commit.

## 8. Web VCS — Push/Pull

- [ ] Push first commit.
- [ ] Verify S3 `repositories/<repoId>/HEAD`.
- [ ] Verify S3 `repositories/<repoId>/metadata.json`.
- [ ] Verify S3 commit snapshot.
- [ ] Push again without new commits.
- [ ] Verify no duplicate commits are created.
- [ ] Create second commit.
- [ ] Verify Push uploads only missing commits.
- [ ] Delete `.vcsRepos/<repoId>`.
- [ ] Open workspace again.
- [ ] Verify local workspace rebuilds from S3.
- [ ] Pull a newer remote commit.
- [ ] Verify workspace matches remote HEAD.
- [ ] Verify pull clears staging.

## 9. Revert

- [ ] Revert a commit from the web.
- [ ] Verify a new child commit is created.
- [ ] Verify original commit remains unchanged.
- [ ] Verify `parent` points to the previous HEAD.
- [ ] Verify `reverts` points to the reverted commit.
- [ ] Push the revert commit.
- [ ] Verify S3 HEAD moves to the revert commit.
- [ ] Non-owner cannot see/use the Revert button.
- [ ] Non-owner receives 403 if attempting the endpoint directly.

## 10. CLI VCS

- [ ] `node index.js login`
- [ ] `node index.js whoami`
- [ ] `node index.js init <repoName>`
- [ ] `node index.js add <file>`
- [ ] `node index.js add .`
- [ ] `node index.js commit "<message>"`
- [ ] `node index.js push`
- [ ] `node index.js pull`
- [ ] `node index.js revert <commitId>`
- [ ] `node index.js logout`

## 11. CLI ↔ Web Interoperability

- [ ] Create repository from frontend as User A.
- [ ] CLI login as User A.
- [ ] `init` the same repository by name.
- [ ] Verify CLI resolves the same MongoDB repository `_id`.
- [ ] CLI commit + push.
- [ ] Verify commit appears in web commit history.
- [ ] Web commit + push.
- [ ] CLI pull.
- [ ] Verify CLI receives the web commit.
- [ ] CLI revert + push.
- [ ] Verify revert appears in web history.
- [ ] Verify browser and CLI use the same S3 prefix.

## 12. S3 Structure

- [ ] S3 contains `repositories/<repoId>/HEAD`.
- [ ] S3 contains `repositories/<repoId>/metadata.json`.
- [ ] S3 contains `repositories/<repoId>/commits/<commitId>/`.
- [ ] S3 does not receive new VCS data under legacy `commits/`.
- [ ] Old legacy S3 data has been removed.
- [ ] `.initFold` is no longer used.
- [ ] `.vcs` is never staged or committed.

## 13. Frontend UX

- [ ] Loading states render correctly.
- [ ] API errors use themed alerts.
- [ ] Destructive actions use themed confirmation dialogs.
- [ ] Repository tabs work on mobile width.
- [ ] File tree opens/closes folders.
- [ ] Code editor line numbers remain aligned.
- [ ] README.md renders from latest remote HEAD.
- [ ] Non-owner sees repository read-only state.
- [ ] Revert button is only visible to the owner.

## 14. Deployment

- [ ] `backend/.env` is NOT committed.
- [ ] `frontend/.env` is NOT committed.
- [ ] `.vcs/config.json` is NOT committed.
- [ ] `.vcsRepos/` is NOT committed.
- [ ] `.initFold/` is NOT committed.
- [ ] No AWS credentials are committed.
- [ ] No MongoDB URI is committed.
- [ ] No JWT secret is committed.
- [ ] Any previously exposed real credentials are rotated.
- [ ] Backend uses deployed `CLIENT_URL`.
- [ ] Frontend uses deployed `VITE_API_URL`.
- [ ] CORS rejects unknown browser origins.
- [ ] MongoDB connection succeeds on EC2.
- [ ] AWS S3 access succeeds on EC2.
- [ ] `npm ci` succeeds in frontend.
- [ ] `npm run build` succeeds.
- [ ] `npm run lint` succeeds.
- [ ] `npm start` starts the backend.
- [ ] CLI login works on the deployed environment.
- [ ] Browser + CLI can operate on the same repository after deployment.
