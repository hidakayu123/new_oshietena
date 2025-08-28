import React from "react";

type SimpleModalProps = {
  visible: boolean;
  title: string;
  onOk?: () => void;
};

const SimpleModal: React.FC<SimpleModalProps> = ({ visible, title, onOk }) => {
  if (!visible) return null;

  return (
    <div className="modal-backdrop" style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 9999,
    }}>
      <div className="modal" style={{
        background: "white",
        padding: "20px",
        borderRadius: "8px",
        maxWidth: "400px",
        width: "90%",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        textAlign: "center",
      }}>
        <h2>{title}</h2>
        <button
          onClick={() => onOk?.()}
          style={{
            marginTop: "20px",
            padding: "8px 16px",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
};

export default SimpleModal;
