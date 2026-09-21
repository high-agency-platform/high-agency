#!/bin/sh
set -eu
export FIREBASE_PROJECT_ID=demo-highagency
export NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-highagency
export NEXT_PUBLIC_FIREBASE_EMULATORS=true
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8088
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export RESEND_API_KEY=""
./node_modules/.bin/firebase emulators:exec --config firebase.qa.json --project demo-highagency --only firestore,auth './node_modules/.bin/tsx scripts/qa-local-seed.mts && ./node_modules/.bin/next dev -p 3001'
