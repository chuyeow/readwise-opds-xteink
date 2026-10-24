// Well-formedness check with expat, the XML parser CrossPoint uses for
// chapters, OPF and NCX. Exit 1 on the first error.
#include <expat.h>

#include <fstream>
#include <iostream>
#include <sstream>

int main(int argc, char** argv) {
  int status = 0;
  for (int i = 1; i < argc; ++i) {
    std::ifstream in(argv[i], std::ios::binary);
    std::stringstream buffer;
    buffer << in.rdbuf();
    const std::string xml = buffer.str();
    XML_Parser parser = XML_ParserCreate(nullptr);
    if (XML_Parse(parser, xml.data(), static_cast<int>(xml.size()), XML_TRUE) == XML_STATUS_ERROR) {
      std::cout << argv[i] << ": line " << XML_GetCurrentLineNumber(parser) << ": "
                << XML_ErrorString(XML_GetErrorCode(parser)) << "\n";
      status = 1;
    }
    XML_ParserFree(parser);
  }
  return status;
}
