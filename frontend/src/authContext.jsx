import React, { createContext, useState, useEffect, useContext } from "react";

const AuthContext = createContext(null);

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const userId = localStorage.getItem("userId");

    if (userId) {
      setCurrentUser(userId);
    }
  }, []);

  const login = (token, userId) => {
    localStorage.setItem("token", token);

    localStorage.setItem("userId", userId);

    setCurrentUser(userId);
  };

  const logout = () => {
    localStorage.removeItem("token");

    localStorage.removeItem("userId");

    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
