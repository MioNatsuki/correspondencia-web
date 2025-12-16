import React from 'react';
import { Button } from '@mui/material';
import { AiOutlinePlus, AiOutlineEdit, AiOutlineDelete, AiOutlineEye } from 'react-icons/ai';
import { BiUpload } from 'react-icons/bi';
import { BsCheckCircle, BsXCircle } from 'react-icons/bs';

const iconMap = {
  add: AiOutlinePlus,
  edit: AiOutlineEdit,
  delete: AiOutlineDelete,
  view: AiOutlineEye,
  upload: BiUpload,
  confirm: BsCheckCircle,
  cancel: BsXCircle,
};

const CustomButton = ({
  children,
  variant = 'contained',
  color = 'primary',
  icon,
  iconPosition = 'start',
  isLoading = false,
  rounded = true,
  ...props
}) => {
  const IconComponent = icon ? iconMap[icon] : null;

  return (
    <Button
      variant={variant}
      color={color}
      disabled={isLoading}
      startIcon={icon && iconPosition === 'start' && <IconComponent />}
      endIcon={icon && iconPosition === 'end' && <IconComponent />}
      sx={{
        borderRadius: rounded ? '20px' : '8px',
        fontWeight: 600,
        textTransform: 'none',
        padding: '8px 20px',
        ...(variant === 'contained' && {
          background: `linear-gradient(135deg, 
            ${color === 'primary' ? '#aae6d9' : '#e6b0aa'}, 
            ${color === 'primary' ? '#7ab3a5' : '#b27a75'})`,
          '&:hover': {
            background: `linear-gradient(135deg, 
              ${color === 'primary' ? '#7ab3a5' : '#b27a75'}, 
              ${color === 'primary' ? '#5a8c7f' : '#8e5e5a'})`,
          },
        }),
      }}
      {...props}
    >
      {isLoading ? 'Cargando...' : children}
    </Button>
  );
};

export default CustomButton;