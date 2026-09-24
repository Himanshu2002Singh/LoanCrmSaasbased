import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../config';

const StatusContext = createContext();

export const useStatuses = () => {
  const context = useContext(StatusContext);
  if (!context) {
    throw new Error('useStatuses must be used within a StatusProvider');
  }
  return context;
};

export const StatusProvider = ({ children }) => {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStatuses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/lead-statuses`);
      if (response.data.success) {
        setStatuses(response.data.statuses);
      }
    } catch (err) {
      console.error('Error fetching statuses:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  const getStatusName = (statusId) => {
    const status = statuses.find(s => s.status_id === statusId);
    return status ? status.name : 'Unknown';
  };

  const getStatusById = (statusId) => {
    return statuses.find(s => s.status_id === statusId);
  };

  const getStatusNames = () => {
    return statuses.map(s => s.name);
  };

  const getStatusNamesWithAll = () => {
    return ['All', ...statuses.map(s => s.name)];
  };

  const refreshStatuses = () => {
    fetchStatuses();
  };

  return (
    <StatusContext.Provider
      value={{
        statuses,
        loading,
        error,
        fetchStatuses,
        getStatusName,
        getStatusById,
        getStatusNames,
        getStatusNamesWithAll,
        refreshStatuses,
      }}
    >
      {children}
    </StatusContext.Provider>
  );
};
