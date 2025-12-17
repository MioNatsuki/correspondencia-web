import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@mui/material';
import { AiOutlineWarning, AiOutlineInfoCircle, AiOutlineQuestionCircle } from 'react-icons/ai';

const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  type = "warning", // 'warning', 'info', 'question'
  severity = "medium", // 'low', 'medium', 'high'
  loading = false,
}) => {
  const getIcon = () => {
    switch (type) {
      case 'info':
        return <AiOutlineInfoCircle size={48} color="#2196f3" />;
      case 'question':
        return <AiOutlineQuestionCircle size={48} color="#ff9800" />;
      default:
        return <AiOutlineWarning size={48} color="#f44336" />;
    }
  };

  const getSeverityColor = () => {
    switch (severity) {
      case 'low':
        return '#4caf50';
      case 'high':
        return '#f44336';
      default:
        return '#ff9800';
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ textAlign: 'center', pt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          {getIcon()}
        </Box>
        <Typography variant="h6" fontWeight={600}>
          {title}
        </Typography>
      </DialogTitle>
      
      <DialogContent sx={{ textAlign: 'center', pb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'center', gap: 2 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          disabled={loading}
          sx={{ 
            borderRadius: 2,
            px: 3,
            borderColor: '#aae6d9',
            color: '#7ab3a5',
          }}
        >
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          disabled={loading}
          sx={{ 
            borderRadius: 2,
            px: 3,
            bgcolor: getSeverityColor(),
            '&:hover': {
              bgcolor: getSeverityColor(),
              opacity: 0.9,
            },
          }}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;