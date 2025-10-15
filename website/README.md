# Proposed Website

## 1. Environment set up

1) Inside of the project's `$ROOT` directory, set up virtual environmnet.

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

## 2. Run website

1) Navigate to the `website` directory.
```
cd $ROOT/website
```

2) You need two separate terminal windows to run.

Open terminal 1
```
# install dependencies
npm install
npm start
```

Open terminal 2
```
python3 app.py  # py app.py for window
```

