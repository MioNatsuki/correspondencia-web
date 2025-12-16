import React from 'react';
import { Box } from '@mui/material';

const LoadingSpinner = ({ size = 40, color = '#aae6d9' }) => {
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        minHeight: '200px'
      }}
    >
      <div className="kawaii-loader">
        <div style={{ borderColor: `${color} transparent transparent transparent` }}></div>
        <div style={{ borderColor: `${color} transparent transparent transparent` }}></div>
        <div style={{ borderColor: `${color} transparent transparent transparent` }}></div>
        <div style={{ borderColor: `${color} transparent transparent transparent` }}></div>
      </div>
    </Box>
  );
};

export default LoadingSpinner;