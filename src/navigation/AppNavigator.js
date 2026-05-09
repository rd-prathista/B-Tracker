import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { hasRegistered } from '../services/authService';

import RegisterScreen from '../screens/RegisterScreen';
import PinSetupScreen from '../screens/PinSetupScreen';
import CurrencySetupScreen from '../screens/CurrencySetupScreen';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import AddTransactionScreen from '../screens/AddTransactionScreen';
import AllTransactionsScreen from '../screens/AllTransactionsScreen';
import ReportsScreen from '../screens/ReportsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SecurityScreen from '../screens/SecurityScreen';
import AboutScreen from '../screens/AboutScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    const registered = await hasRegistered();
    setIsRegistered(registered);
    setLoading(false);
  };

  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          !isRegistered ? (
            <>
              <Stack.Screen 
                name="Register" 
                component={RegisterScreen} 
                initialParams={{ onRegisterSuccess: () => {
                  setIsRegistered(true);
                  setIsAuthenticated(true);
                }}}
              />
              <Stack.Screen 
                name="PinSetup" 
                component={PinSetupScreen} 
              />
              <Stack.Screen 
                name="CurrencySetup" 
                component={CurrencySetupScreen} 
              />
            </>
          ) : (
            <Stack.Screen 
              name="Login" 
              component={LoginScreen}
              initialParams={{ 
                onLoginSuccess: () => setIsAuthenticated(true),
                onReset: () => {
                  setIsRegistered(false);
                  setIsAuthenticated(false);
                }
              }}
            />
          )
        ) : (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="AddTransaction" component={AddTransactionScreen} />
            <Stack.Screen name="AllTransactions" component={AllTransactionsScreen} />
            <Stack.Screen name="Reports" component={ReportsScreen} />
            <Stack.Screen 
              name="Settings" 
              component={SettingsScreen} 
              initialParams={{ onLogout: () => setIsAuthenticated(false) }}
            />
            <Stack.Screen name="Security" component={SecurityScreen} />
            <Stack.Screen name="About" component={AboutScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
