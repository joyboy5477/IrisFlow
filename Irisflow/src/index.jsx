import React from "react";
import { createRoot } from "react-dom/client";
import MainIrisWindow from "./mainIrisWindow/MainIrisWindow";
import "./styles.css";

const container = document.getElementById("root");
createRoot(container).render(<MainIrisWindow />);
