import React from 'react';
import type { IconProps } from '../types';

export const ScrewEditor = (props: IconProps) => (
  <svg
    width="24px"
    height="24px"
    viewBox="0 0 24 24"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: '24px', height: '24px', minWidth: '24px', flex: 'none' }}
    {...props}
  >
    <g
      id="ScrewEditor"
      stroke="none"
      strokeWidth="1"
      fill="none"
      fillRule="evenodd"
    >
      <g
        id="screw-icon"
        transform="translate(4, 2)"
        fill="currentColor"
      >
        {/* Screw head (hexagonal) */}
        <path
          d="M8,0 L12,2.3 L12,6.7 L8,9 L4,6.7 L4,2.3 Z"
          id="screw-head"
        />
        {/* Screw shaft with threads */}
        <rect
          id="shaft"
          x="6"
          y="9"
          width="4"
          height="2"
        />
        <path
          d="M5.5,11 L10.5,11 L10.5,13 L5.5,13 Z"
          id="thread1"
        />
        <rect
          id="shaft2"
          x="6"
          y="13"
          width="4"
          height="1"
        />
        <path
          d="M5.5,14 L10.5,14 L10.5,16 L5.5,16 Z"
          id="thread2"
        />
        <rect
          id="shaft3"
          x="6"
          y="16"
          width="4"
          height="1"
        />
        <path
          d="M5.5,17 L10.5,17 L10.5,19 L5.5,19 Z"
          id="thread3"
        />
        {/* Pointed tip */}
        <path
          d="M6,19 L10,19 L8,22 Z"
          id="tip"
        />
      </g>
    </g>
  </svg>
);

export default ScrewEditor;

