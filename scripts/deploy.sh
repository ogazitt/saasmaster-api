#!/bin/bash
gcloud beta run deploy saasmaster-api \
  --image gcr.io/saasmaster/saasmaster-api \
  --platform managed