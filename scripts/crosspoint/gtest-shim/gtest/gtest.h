// CrossPoint's OPF test stubs assert with EXPECT_TRUE; outside gtest a
// failed expectation just reports to stderr.
#pragma once
#include <iostream>

#define EXPECT_TRUE(condition) \
  if (condition) {             \
  } else                       \
    std::cerr << "expectation failed: " #condition " "
