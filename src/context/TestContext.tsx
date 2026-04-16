import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TestContextType {
  isTestRunning: boolean;
  setIsTestRunning: (running: boolean) => void;
}

const TestContext = createContext<TestContextType | undefined>(undefined);

export const TestProvider = ({ children }: { children: ReactNode }) => {
  const [isTestRunning, setIsTestRunning] = useState(false);

  return (
    <TestContext.Provider value={{ isTestRunning, setIsTestRunning }}>
      {children}
    </TestContext.Provider>
  );
};

export const useTestContext = () => {
  const context = useContext(TestContext);
  if (context === undefined) {
    throw new Error('useTestContext must be used within a TestProvider');
  }
  return context;
};
