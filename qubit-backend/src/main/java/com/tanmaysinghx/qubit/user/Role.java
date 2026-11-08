package com.tanmaysinghx.qubit.user;

public enum Role {
    QUBIT_USER,
    QUBIT_ADMIN,
    QUBIT_SUPERADMIN;

    public boolean isStaff() {
        return this == QUBIT_ADMIN || this == QUBIT_SUPERADMIN;
    }
}
