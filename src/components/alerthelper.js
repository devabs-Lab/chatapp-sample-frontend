import Swal from "sweetalert2";

// Success alert
export function showSuccessAlert(
  title = "Success",
  text = "Operation completed",
  onConfirm = null
) {
  Swal.fire({
    icon: "success",
    title,
    text,
    confirmButtonText: "OK",

    customClass: {
      icon: "tiny-icon",
      popup: "tiny-popup",
      title: "tiny-title",
      htmlContainer: "tiny-text",
      confirmButton: "tiny-button",
    },
  }).then((result) => {
    if (result.isConfirmed && onConfirm) {
      onConfirm();
    }
  });
}

// Error alert
export function showErrorAlert(
  title = "Something went wrong",
  text = "Please try again"
) {
  Swal.fire({
    icon: "error",
    title,
    text,
    confirmButtonText: "Retry",

    customClass: {
      icon: "tiny-icon",
      popup: "tiny-popup",
      title: "tiny-title",
      htmlContainer: "tiny-text",
      confirmButton: "tiny-button",
    },
  });
}
