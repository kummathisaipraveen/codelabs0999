# Vercel Deployment Plan

This plan outlines the steps to make the CodeCoach platform "deploy ready" on Vercel, ensuring both the Vite frontend and FastAPI backend work seamlessly.

## User Review Required

> [!IMPORTANT]
> **Execution Engine**: Vercel Serverless Functions do **not** support Docker. The backend's `/execute` endpoint (which uses Docker) will be disabled in the cloud. The platform will automatically fall back to **Pyodide (Browser-side execution)**, which is already implemented and production-ready.

## Proposed Changes

### Configuration
#### [NEW] [vercel.json](file:///c:/Users/91779/o/codelabs0999/vercel.json)
Create a Vercel configuration file to:
*   Route `/api/(.*)` requests to the FastAPI backend.
*   Configure the Python runtime for serverless functions.
*   Ensure the Vite build output is served correctly.

### Backend
#### [MODIFY] [main.py](file:///c:/Users/91779/o/codelabs0999/backend/main.py)
*   Ensure the `app` instance is correctly exposed for Vercel.
*   Add a check to prevent the execution service from trying to use Docker if running in a serverless environment.

### Frontend
#### [MODIFY] [vite.config.ts](file:///c:/Users/91779/o/codelabs0999/vite.config.ts)
*   Ensure the proxy configuration is correct for local development while allowing Vercel to handle production routing.

## Verification Plan

### Automated Tests
*   Run `npm run build` locally to ensure the frontend compiles without errors.
*   Verify `main.py` can be imported by a serverless harness.

### Manual Verification
*   Check that all environment variables are documented (SUPABASE_URL, SUPABASE_KEY, GEMINI_API_KEY, etc.).
