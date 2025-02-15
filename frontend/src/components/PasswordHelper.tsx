import React from "react";

import { PasswordValidation } from "@/utils/passwordValidation";

interface PasswordHelperProps {
  validateResult: PasswordValidation[];
}

const PasswordHelper: React.FC<PasswordHelperProps> = ({ validateResult }) => {
  return (
    <div className="mt-2">
      <span className="text-neutral-800 font-semibold text-sm mb-2">
        A password must:
      </span>
      {validateResult.map((validation) => (
        <div
          key={validation.message}
          className="flex items-center flex-row text-sm text-neutral-600 font-regular mt-1"
        >
          <svg
            className="h-4 w-4 mr-2 mt-0.5"
            fill={validation.satisfied ? "#00B754" : "#BFBFBF"}
            viewBox="0 0 20 20"
          >
            <path
              clipRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              fillRule="evenodd"
            />
          </svg>
          {validation.message}
        </div>
      ))}
    </div>
  );
};

export default PasswordHelper;
