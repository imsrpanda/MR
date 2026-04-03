@echo off
where java
java -XshowSettings:all -version 2>&1 | findstr java.home
