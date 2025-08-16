import { createContext, useContext, useState } from "react";
import React from "react";

const AuthContext = createContext<{ token: string | null, setToken: (token: string) => void }>({
  token: null,
  setToken: () => {}
});

export const useAuthToken = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);

  return (
    <AuthContext.Provider value={{ token, setToken }}>
      {children}
    </AuthContext.Provider>
  );
};
