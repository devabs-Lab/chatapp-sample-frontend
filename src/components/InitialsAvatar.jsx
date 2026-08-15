import React from "react";

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.split(" ").filter((p) => p.length > 0);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const getColorForName = (name) => {
  if (!name) return "var(--plum)";
  const colors = [
    "#91006C", // --m
    "#4A335D", // --plum
    "#7B5E94", // --plum-lt
    "#7B3F9E", // PW
    "#2E7D9E", // JR
    "#2E7D52", // EN
    "#8E24AA",
    "#00897B",
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const InitialsAvatar = ({ 
  name, 
  size = "md", 
  status = "offline", 
  imageUrl = null,
  onClick,
  className = "",
  borderRadius = "50%",
  backgroundColor,
  color
}) => {
  
  const sizeMap = {
    sm: { width: "24px", height: "24px", fontSize: "11px" }, // Sm is 24x24 per spec
    md: { width: "32px", height: "32px", fontSize: "12px" }, // Md is 32x32 per spec
    lg: { width: "40px", height: "40px", fontSize: "14px" }, // Lg is 40x40 per spec
    xl: { width: "56px", height: "56px", fontSize: "20px" }  // Xl is 56x56 per spec
  };
  
  const selectedSize = sizeMap[size] || sizeMap.md;
  
  const style = {
    ...selectedSize,
    borderRadius: borderRadius,
    backgroundColor: backgroundColor || getColorForName(name),
    color: color || "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "600",
    flexShrink: 0,
    position: "relative",
    cursor: onClick ? "pointer" : "default"
  };

  const statusStyle = {
    position: "absolute",
    bottom: "0px",
    right: "0px",
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    backgroundColor: status === "online" ? "var(--grn)" : "var(--lav-dk)",
    border: "1.5px solid white",
    display: status === "none" ? "none" : "block"
  };

  if (imageUrl) {
    return (
      <div 
        style={{ ...selectedSize, position: "relative", flexShrink: 0, cursor: onClick ? "pointer" : "default" }} 
        className={className} 
        onClick={onClick}
      >
        <img 
          src={imageUrl} 
          alt={name} 
          style={{ width: "100%", height: "100%", borderRadius: borderRadius, objectFit: "cover" }} 
        />
        <div style={statusStyle} />
      </div>
    );
  }

  return (
    <div style={style} className={className} onClick={onClick}>
      {getInitials(name)}
      <div style={statusStyle} />
    </div>
  );
};

export default InitialsAvatar;
