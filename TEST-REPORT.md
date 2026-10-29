# Test report — Secure Application Integration

## Test scope
The automated Node.js test suite (`npm test`) is designed to verify:

| Area | Expected result |
|---|---|
| Health endpoint | `GET /health` returns HTTP 200 and status `ok` |
| Security headers | Helmet headers are present and `X-Powered-By` is absent |
| Listing and pagination | Listing returns records and pagination metadata |
| Catalogue CRUD | Create, read, update, and delete work with admin authorization |
| Admin access control | Unauthenticated catalogue write returns HTTP 401 |
| Validation | Invalid internship and application payloads return HTTP 400 |
| Application form API | Valid application returns HTTP 201 and an application reference |
| Frontend integration | Express serves the internship board HTML from `/` |

## Execution status
The project files and tests have been prepared. Automated execution could not be completed in this environment because `npm install` timed out while attempting to install dependencies. **Do not report these tests as passed until you run `npm install` and `npm test` successfully on your computer or CI.**

## Local verification
1. Run `npm install`.
2. Set `ADMIN_API_KEY` in the terminal environment.
3. Run `npm test`.
4. Run `npm run seed`, then `npm start`.
5. Open `http://localhost:3000` and verify listings, keyword/domain filtering, retry state (temporarily stop the server and refresh), and application form success/validation.
