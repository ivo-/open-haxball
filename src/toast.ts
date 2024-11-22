import Toast from "typescript-toastify";
import { ToastType } from "typescript-toastify/lib/type/type";

export const toast = (message: string, type: ToastType = "default") =>
  new Toast({
    type,
    position: "top-right",
    toastMsg: message,
    autoCloseTime: 2500,
    canClose: true,
    showProgress: true,
    pauseOnHover: true,
    pauseOnFocusLoss: true,
    theme: "dark",
  });
