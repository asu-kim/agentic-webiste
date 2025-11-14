# Proposed Website

## 1. Environment set up

1) Inside the project's `$ROOT` directory, set up a virtual environment.

    macOS or Linux
    ```
    python3 -m venv .venv
    source .venv/bin/activate
    ```
    
    Window environment 
    ```
    py -m venv .venv
    venv\Scripts\activate.bat
    ```

2) Install Python Dependencies
```
pip install -r requirements.txt
```

3) Check `iotauth` submodule
```
cd $ROOT/iotauth
git submodule update --init --recursive
git pull
```

## 2. Run website

You need **four** separate terminal windows to run.

Open terminal 1
```
# install dependencies
cd $ROOT/website
npm install
npm start
```

Open terminal 2
```
cd $ROOT/website
python3 app.py  # py app.py for window
```

Open terminal 3
```
# generate entities
cd $ROOT/iotauth/examples
./generateAll.sh -g configs/agentAccess.graph 
```

```
# start Auth
cd $ROOT/iotauth/auth/auth-server
make
java -jar target/auth-server-jar-with-dependencies.jar -p ../properties/exampleAuth101.properties
```

Open terminal 4
```
# generate key for delegate access to agent
cd $ROOT/iotauth/entity/node/example_entities
node user.js configs/net1/user.config 
```
Inside the program, enter the following command to delegate access.

The `<trust_level>` argument accepts one of the following values: `high`, `medium`, or `low`.
```
delegateAccess <trust_level>
```
Terminate the program after checking the `sessionKeyID`.

**TODO** setup agent program? get session key manually?
