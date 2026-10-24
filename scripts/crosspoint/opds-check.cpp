// Parses an OPDS feed with CrossPoint's own OpdsParser and prints what the
// device would show. Exit 1 when the parser errors or finds no entries.
// Built twice: against the current SDK parser and, with OPDS_PARSER_1_6, the
// one in the 1.6.x releases (no feed title or descriptions there).
#include <OpdsParser.h>

#include <cstdio>
#include <fstream>
#include <iostream>
#include <sstream>

int main(int argc, char** argv) {
  if (argc != 2) {
    std::cerr << "usage: opds-check <feed.xml>\n";
    return 2;
  }
  std::ifstream in(argv[1], std::ios::binary);
  std::stringstream buffer;
  buffer << in.rdbuf();
  const std::string xml = buffer.str();

  OpdsParser parser;
  // The device feeds the parser network-sized chunks; mimic that.
  for (size_t offset = 0; offset < xml.size(); offset += 1460) {
    const size_t len = std::min<size_t>(1460, xml.size() - offset);
    parser.write(reinterpret_cast<const uint8_t*>(xml.data() + offset), len);
  }
  parser.flush();

  if (parser.error()) {
    std::cout << "PARSE ERROR\n";
    return 1;
  }
#ifndef OPDS_PARSER_1_6
  std::cout << "feed title: " << parser.getFeedTitle() << "\n";
#endif
  std::cout << "next page: " << parser.getNextPageUrl() << "\n";
  size_t books = 0;
  size_t navigation = 0;
  for (const auto& entry : parser.getEntries()) {
    const bool isBook = entry.type == OpdsEntryType::BOOK;
    (isBook ? books : navigation)++;
    std::cout << (isBook ? "BOOK " : "NAV  ") << entry.title << " | " << entry.author << " | " << entry.href << " |";
#ifndef OPDS_PARSER_1_6
    std::cout << " " << entry.description.substr(0, 60);
#endif
    std::cout << "\n";
  }
  std::cout << "books: " << books << "\nnavigation: " << navigation << "\n";
  return books + navigation > 0 ? 0 : 1;
}
