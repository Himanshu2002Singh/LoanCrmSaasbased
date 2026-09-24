import React from "react";

import "../styles/adminSectionSkin.css";

function RedesignPageFrame({ children, pageKey = "section" }) {
  return (
    <div className={`cc-page-wrap cc-section-skin cc-section-${pageKey}`}>
      {children}
    </div>
  );
}

export default RedesignPageFrame;
