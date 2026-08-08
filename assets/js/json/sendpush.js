const admin = require("firebase-admin");
admin.initializeApp({
    credential: admin.credential.applicationDefault()
});

const message = {
    notification: {
        title: "Título de la Notificación",
        body: "Cuerpo de la Notificación"
    },
    token: "TOKEN_DEL_DISPOSITIVO"
};

admin.messaging().send(message)
    .then((response) => {
        console.log('Successfully sent message:', response);
    })
    .catch((error) => {
        console.log('Error sending message:', error);
    });