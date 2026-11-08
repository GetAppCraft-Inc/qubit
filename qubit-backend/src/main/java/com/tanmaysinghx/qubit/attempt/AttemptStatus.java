package com.tanmaysinghx.qubit.attempt;

public enum AttemptStatus {
    IN_PROGRESS, SUBMITTED, AUTO_SUBMITTED, TERMINATED;

    public boolean isFinished() { return this != IN_PROGRESS; }
}
