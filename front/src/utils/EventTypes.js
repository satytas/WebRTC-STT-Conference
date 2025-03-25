export const EventTypes = Object.freeze({
    // Client to Server events
    CLIENT_JOIN_ROOM: "client:join-room",
    CLIENT_CREATE_ROOM: "client:create-room",
    CLIENT_VALIDATE_ROOM: "client:validate-room",
    CLIENT_VALIDATE_PASSWORD: "client:validate-password",
    CLIENT_DISCONNECT: "client:disconnect",

    // Server to Client events
    SERVER_WELCOME: "server:welcome",
    SERVER_ROOM_CREATED: "server:room-created",
    SERVER_ROOM_VALIDATION: "server:room-validation",
    SERVER_PASSWORD_VALIDATION: "server:password-validation",
    SERVER_NEW_USER: "server:new-user",

    // Client to Client (WebRTC) events
    PEER_OFFER: "peer:offer",
    PEER_ANSWER: "peer:answer",
    PEER_ICE_CANDIDATE: "peer:ice-candidate",
    PEER_USER_LEFT: "peer:user-left"
});

