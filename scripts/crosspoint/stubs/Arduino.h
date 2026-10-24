// Host stub: OpdsParser sizes its entry buffer from the largest free heap
// block. 40 KB approximates what is left on an ESP32-C3 mid-TLS.
#pragma once
#include <cstddef>
#include <cstdint>

struct EspStub {
  size_t getMaxAllocHeap() const { return 40 * 1024; }
  size_t getFreeHeap() const { return 80 * 1024; }
};
inline EspStub ESP;
