// src/context/PrayerContext.js
import React, { createContext, useState } from "react";

export const PrayerContext = createContext();

export const PrayerProvider = ({ children }) => {
  const [prayer, setprayer] = useState({});

  return (
    <PrayerContext.Provider value={{ prayer, setprayer }}>
      {children}
    </PrayerContext.Provider>
  );
};