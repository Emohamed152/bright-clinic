// Address of the backend API (the Vercel project from the "backend" folder).
// Set it in Vercel > frontend project > Settings > Environment Variables as VITE_API_URL
// (it is public, not a secret). Example: https://bright-clinic-api.vercel.app
export const API_URL: string = ((import.meta.env.VITE_API_URL as string | undefined) || '').replace(/\/$/, '');
