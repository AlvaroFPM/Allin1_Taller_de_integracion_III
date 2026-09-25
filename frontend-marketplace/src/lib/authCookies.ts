import Cookies from 'js-cookie';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const setAuthTokens = (accessToken: string, refreshToken?: string) => {
  // Guardar token con expiración de 1 día y Secure/SameSite activado
  Cookies.set(TOKEN_KEY, accessToken, {
    expires: 1,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });

  if (refreshToken) {
    Cookies.set(REFRESH_TOKEN_KEY, refreshToken, {
      expires: 7,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
  }
};

export const getAccessToken = (): string | undefined => {
  return Cookies.get(TOKEN_KEY);
};

export const getRefreshToken = (): string | undefined => {
  return Cookies.get(REFRESH_TOKEN_KEY);
};

export const removeAuthTokens = () => {
  Cookies.remove(TOKEN_KEY);
  Cookies.remove(REFRESH_TOKEN_KEY);
};
