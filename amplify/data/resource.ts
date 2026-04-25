import { type ClientSchema, a, defineData, defineAuth } from '@aws-amplify/backend';

const schema = a.schema({
  Note: a
    .model({
      name: a.string(),
      description: a.string(),
      image: a.string(),
    })
    .authorization((allow) => [
      allow.owner().to(["create", "read", "update", "delete"]),
    ]),
  ShareRequest: a
    .model({
      senderEmail: a.string(),
      recipientEmail: a.string(),
      name: a.string(),
      description: a.string(),
      image: a.string(),
      status: a.string(),
    })
    .authorization((allow) => [
      allow.authenticated().to(["create", "read", "update", "delete"]),
    ]),
});



export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool', // 🔴 ważne!
  },
});
