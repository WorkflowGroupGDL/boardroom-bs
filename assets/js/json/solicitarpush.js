Notification.requestPermission().then((permission) => {
    if (permission === 'granted') {
        console.log('Notification permission granted.');
        // Aquí puedes obtener el token
        getToken();
    } else {
        console.log('Unable to get permission to notify.');
    }
});

import { getToken } from "firebase/messaging";

function getToken() {
    getToken(messaging, { vapidKey: 'BO7ktUWPeipX7Jg1klk5fTBPlnSPJBwulguRngSHtrhhVq62BVCWR15vS-oxUxkFabA_ZHHUAiQMQVYaGa_bxX8' }).then((currentToken) => {
        if (currentToken) {
            console.log('Current token for client: ', currentToken);
            // Enviar el token a tu servidor o almacenarlo
        } else {
            console.log('No registration token available. Request permission to generate one.');
        }
    }).catch((err) => {
        console.log('An error occurred while retrieving token. ', err);
    });
}

import { onMessage } from "firebase/messaging";

onMessage(messaging, (payload) => {
    console.log('Message received. ', payload);
    // Personaliza la notificación aquí
});

