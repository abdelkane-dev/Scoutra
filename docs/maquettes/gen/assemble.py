import sys
N='/tmp/claude-0/-home-user/46a28097-9136-5448-9a55-0ea1cd91f980/scratchpad/'
icons=open(N+'icons.svg').read().strip(); logo=open(N+'logo-inline.svg').read().strip()
for f in sys.argv[1:]:
    s=open(f).read(); s=s.replace('<!--ICONS-->',icons).replace('<!--LOGO-->',logo); open(f,'w').write(s); print(f, s.count('class="logo"'))
