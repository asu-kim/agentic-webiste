import React, { useEffect, useState} from "react";

export default function Dashboard(){
    const [user, setUser] = useState(null);

    // const u = localStorage.getItem("username");
    // setUser(u);

      useEffect(() => {
        const username = localStorage.getItem("username") || "Guest";
        setUser(username);
    }, []);
    return (
        <div>
            <h1 className='margin'>Dashboard</h1>
            <p className='margin'>{`Hello, ${user}!`}</p>
        </div>
    )
}