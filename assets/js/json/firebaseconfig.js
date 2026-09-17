import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
    apiKey: "AIzaSyBwnO9TbbtDMSuzRdqvICnAy81OmLgBXc0",
    authDomain: "vivehoy-lifecoaching.firebaseapp.com",
    projectId: "vivehoy-lifecoaching",
    storageBucket: "vivehoy-lifecoaching.appspot.com",
    messagingSenderId: "955391466740",
    appId: "1:955391466740:web:8420397fcfaf9172b9d2a1"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);