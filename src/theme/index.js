import { createTheme } from '@mui/material/styles'

const SB_GREEN = '#3ECF8E'

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: SB_GREEN,
      contrastText: '#0F1117',
    },
    secondary: {
      main: '#60A5FA',
    },
    background: {
      default: '#0F1117',
      paper: '#1C1C27',
    },
    divider: '#2A2A40',
    text: {
      primary: '#E2E8F0',
      secondary: '#8B8FA8',
      disabled: '#4A4E65',
    },
    error: { main: '#EF4444' },
    warning: { main: '#FBBF24' },
    success: { main: SB_GREEN },
    info: { main: '#60A5FA' },
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
    h5: { fontWeight: 600, letterSpacing: '-0.4px' },
    h6: { fontWeight: 600, letterSpacing: '-0.3px' },
    subtitle2: { color: '#8B8FA8', fontSize: '0.8rem' },
    body2: { fontSize: '0.8125rem' },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: 'thin',
          scrollbarColor: '#2A2A40 transparent',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { background: '#2A2A40', borderRadius: 3 },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid #2A2A40',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: 8,
        },
        containedPrimary: {
          color: '#0F1117',
          '&:hover': { backgroundColor: '#34BA7A' },
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small', variant: 'outlined' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#181824',
            '& fieldset': { borderColor: '#2A2A40' },
            '&:hover fieldset': { borderColor: '#3A3A55' },
            '&.Mui-focused fieldset': {
              borderColor: SB_GREEN,
              boxShadow: `0 0 0 2px ${SB_GREEN}22`,
            },
          },
        },
      },
    },
    MuiSelect: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: {
          backgroundColor: '#181824',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2A2A40' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#3A3A55' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: SB_GREEN },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1C1C27',
          border: '1px solid #2A2A40',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, fontWeight: 500, fontSize: '0.7rem' },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: '#2A2A40' },
        head: { color: '#8B8FA8', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' },
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: 'none',
          backgroundColor: 'transparent',
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: '#181824',
            borderBottom: '1px solid #2A2A40',
          },
          '& .MuiDataGrid-columnHeaderTitle': {
            color: '#8B8FA8',
            fontWeight: 600,
            fontSize: '0.72rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          },
          '& .MuiDataGrid-row': {
            '&:hover': { backgroundColor: 'rgba(255,255,255,0.03)' },
            '&.Mui-selected': {
              backgroundColor: `${SB_GREEN}14`,
              '&:hover': { backgroundColor: `${SB_GREEN}1E` },
            },
          },
          '& .MuiDataGrid-cell': {
            borderColor: '#2A2A40',
            fontSize: '0.8125rem',
          },
          '& .MuiDataGrid-footerContainer': {
            borderTop: '1px solid #2A2A40',
            backgroundColor: '#181824',
          },
          '& .MuiDataGrid-toolbarContainer': {
            padding: '8px 16px',
            borderBottom: '1px solid #2A2A40',
            gap: 8,
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1C1C27',
          border: 'none',
          borderRight: '1px solid #2A2A40',
        },
      },
    },
  },
})
