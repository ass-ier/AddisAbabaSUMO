import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const DebugAuth = () => {
  const { user } = useAuth();
  const token = sessionStorage.getItem('token');
  const userFromStorage = sessionStorage.getItem('user');

  return (
    <div style={{ 
      padding: '20px', 
      border: '2px solid #ccc', 
      margin: '20px', 
      backgroundColor: '#f9f9f9',
      borderRadius: '8px',
      fontFamily: 'monospace'
    }}>
      <h3 style={{ color: '#333', marginBottom: '15px' }}>🔍 Authentication Debug Info</h3>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>User from Context:</strong>
        <pre style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '4px', overflow: 'auto' }}>
          {user ? JSON.stringify(user, null, 2) : 'null'}
        </pre>
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Token in SessionStorage:</strong> 
        <span style={{ color: token ? 'green' : 'red', fontWeight: 'bold' }}>
          {token ? '✅ Present' : '❌ Missing'}
        </span>
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>User in SessionStorage:</strong>
        <pre style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '4px', overflow: 'auto' }}>
          {userFromStorage || 'null'}
        </pre>
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Current Role:</strong> 
        <span style={{ 
          color: user?.role === 'super_admin' ? 'green' : 'orange', 
          fontWeight: 'bold',
          padding: '4px 8px',
          backgroundColor: user?.role === 'super_admin' ? '#e8f5e8' : '#fff3cd',
          borderRadius: '4px'
        }}>
          {user?.role || 'Not logged in'}
        </span>
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Can Access Admin Pages:</strong> 
        <span style={{ 
          color: user?.role === 'super_admin' ? 'green' : 'red', 
          fontWeight: 'bold' 
        }}>
          {user?.role === 'super_admin' ? '✅ Yes' : '❌ No'}
        </span>
      </div>

      <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
        <strong>💡 Solution:</strong> 
        {user?.role !== 'super_admin' && (
          <span style={{ color: '#1976d2' }}>
            You need to log in as a user with 'super_admin' role to access user management.
          </span>
        )}
        {user?.role === 'super_admin' && (
          <span style={{ color: '#388e3c' }}>
            You have the correct permissions! ✨
          </span>
        )}
      </div>
    </div>
  );
};

export default DebugAuth;