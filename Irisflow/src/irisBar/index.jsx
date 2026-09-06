import React from "react";
import { createRoot } from "react-dom/client";
import IrisBar from "./IrisBar";
import "./css/irisBarTheme.css";
import "./css/irisBarAnimations.css";
import "./css/irisBar.css";

const container = document.getElementById("iris-bar-root");
createRoot(container).render(<IrisBar />);
