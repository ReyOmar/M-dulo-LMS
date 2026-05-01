import Swal from 'sweetalert2';

export const showAlert = {
  success: (title: string, text?: string) => {
    return Swal.fire({
      title,
      text,
      icon: 'success',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#10b981', // emerald-500
      background: 'var(--background, #ffffff)',
      color: 'var(--foreground, #000000)',
      customClass: {
        popup: 'rounded-2xl border border-border shadow-xl',
        confirmButton: 'rounded-xl font-bold px-6 py-2.5 shadow-md',
      }
    });
  },
  error: (title: string, text?: string) => {
    return Swal.fire({
      title,
      text,
      icon: 'error',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#ef4444', // red-500
      background: 'var(--background, #ffffff)',
      color: 'var(--foreground, #000000)',
      customClass: {
        popup: 'rounded-2xl border border-border shadow-xl',
        confirmButton: 'rounded-xl font-bold px-6 py-2.5 shadow-md',
      }
    });
  },
  warning: (title: string, text?: string) => {
    return Swal.fire({
      title,
      text,
      icon: 'warning',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#f59e0b', // amber-500
      background: 'var(--background, #ffffff)',
      color: 'var(--foreground, #000000)',
      customClass: {
        popup: 'rounded-2xl border border-border shadow-xl',
        confirmButton: 'rounded-xl font-bold px-6 py-2.5 shadow-md',
      }
    });
  },
  info: (title: string, text?: string) => {
    return Swal.fire({
      title,
      text,
      icon: 'info',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#3b82f6', // blue-500
      background: 'var(--background, #ffffff)',
      color: 'var(--foreground, #000000)',
      customClass: {
        popup: 'rounded-2xl border border-border shadow-xl',
        confirmButton: 'rounded-xl font-bold px-6 py-2.5 shadow-md',
      }
    });
  }
};
