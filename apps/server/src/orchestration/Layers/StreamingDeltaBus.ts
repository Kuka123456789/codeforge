/**
 * StreamingDeltaBusLive - PubSub-backed implementation.
 */
import type { StreamingTextDeltaPayload } from "@codeforge/contracts";
import { Effect, Layer, PubSub, Stream } from "effect";
import {
  StreamingDeltaBusService,
  type StreamingDeltaBusShape,
} from "../Services/StreamingDeltaBus.ts";

const make = Effect.gen(function* () {
  const pubsub = yield* PubSub.unbounded<StreamingTextDeltaPayload>();

  return {
    publish: (delta) => PubSub.publish(pubsub, delta).pipe(Effect.asVoid),
    stream: Stream.fromPubSub(pubsub),
  } satisfies StreamingDeltaBusShape;
});

export const StreamingDeltaBusLive = Layer.effect(StreamingDeltaBusService, make);
