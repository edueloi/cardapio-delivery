import { io } from "socket.io-client";

const socket = io(); // Connects to the same host that serves the page

export default socket;
