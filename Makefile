
PGRM_DIR = $(abspath .)
include Makefile.include

start: $(START_TARGETS)
	
stop: $(STOP_TARGETS)
	
clean: $(CLEAN_TARGETS)
	
system-tests: $(SYSTEM_TEST_TARGETS)
	
unit-tests: $(UNIT_TEST_TARGETS)